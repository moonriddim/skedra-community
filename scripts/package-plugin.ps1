param([Parameter(Mandatory = $true)][uri]$McpUrl)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginRoot = Join-Path $repoRoot 'plugins/skedra'
$manifestPath = Join-Path $pluginRoot 'plugin.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$openai = $manifest.extensions.'com.openai'

if ($manifest.name -ne 'skedra' -or $manifest.version -notmatch '^\d+\.\d+\.\d+$') {
	throw 'Expected the skedra plugin with a semantic version.'
}
if ($openai.interface.shortDescription.Length -gt 30) { throw 'Subtitle exceeds 30 characters.' }
if ($openai.interface.displayName.Length -gt 30) { throw 'Display name exceeds 30 characters.' }
if ($openai.interface.longDescription.Length -gt 4000) { throw 'Description exceeds 4000 characters.' }
foreach ($translation in $openai.publication.translations.PSObject.Properties) {
	if ($translation.Value.subtitle.Length -gt 30 -or $translation.Value.description.Length -gt 4000) {
		throw "Translation exceeds listing limits: $($translation.Name)"
	}
}
$prompts = @($openai.interface.defaultPrompt)
if ($prompts.Count -lt 1 -or $prompts.Count -gt 3) { throw 'Expected 1-3 default prompts.' }
foreach ($prompt in $prompts) {
	if ([string]::IsNullOrWhiteSpace($prompt) -or $prompt.Length -gt 128 -or $prompt -match '[\r\n\t]') {
		throw 'Invalid default prompt.'
	}
}
if (@($openai.review.test_cases.positive).Count -ne 5 -or @($openai.review.test_cases.negative).Count -ne 3) {
	throw 'Expected five positive and three negative review cases.'
}
foreach ($case in $openai.review.test_cases.positive) {
	foreach ($field in @('description', 'prompt', 'tools_triggered', 'expected_behavior')) {
		if ([string]::IsNullOrWhiteSpace($case.$field)) { throw "Missing positive case field: $field" }
	}
}
foreach ($case in $openai.review.test_cases.negative) {
	if ([string]::IsNullOrWhiteSpace($case.description) -or [string]::IsNullOrWhiteSpace($case.prompt)) {
		throw 'Missing negative case description or prompt.'
	}
}
foreach ($field in @('websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL')) {
	$url = [uri]$openai.interface.$field
	if ($url.Scheme -ne 'https' -or $url.UserInfo -or $url.OriginalString.Length -gt 1024) {
		throw "Invalid listing URL: $field"
	}
}

# Regenerate the compatibility files from canonical source; never edit a cache.
$compatibility = [ordered]@{}
foreach ($field in @('name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords')) {
	$compatibility[$field] = $manifest.$field
}
$compatibility.skills = './skills/'
$compatibility.mcpServers = './.mcp.json'
$compatibility.interface = $openai.interface
$compatibility.extensions = @{ 'com.openai' = @{ review = $openai.review; publication = $openai.publication } }
$compatibilityDir = Join-Path $pluginRoot '.codex-plugin'
New-Item -ItemType Directory -Path $compatibilityDir -Force | Out-Null
$encoding = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $compatibilityDir 'plugin.json'), ($compatibility | ConvertTo-Json -Depth 30) + "`n", $encoding)
$mcp = Get-Content -LiteralPath (Join-Path $pluginRoot 'mcp.json') -Raw | ConvertFrom-Json
if ($McpUrl.UserInfo -or $McpUrl.Query -or $McpUrl.Fragment -or $McpUrl.AbsolutePath -ne '/api/mcp' -or
	($McpUrl.Scheme -ne 'https' -and -not ($McpUrl.Scheme -eq 'http' -and $McpUrl.IsLoopback))) {
	throw 'Use your instance HTTPS /api/mcp endpoint, or HTTP only for a loopback development instance.'
}
$mcp.mcpServers.skedra.url = $McpUrl.AbsoluteUri
[System.IO.File]::WriteAllText((Join-Path $pluginRoot 'mcp.json'), ($mcp | ConvertTo-Json -Depth 10) + "`n", $encoding)
$legacyMcp = @{ mcpServers = @{ skedra = @{ type = 'http'; url = $mcp.mcpServers.skedra.url } } }
[System.IO.File]::WriteAllText((Join-Path $pluginRoot '.mcp.json'), ($legacyMcp | ConvertTo-Json -Depth 10) + "`n", $encoding)

# Generated metadata must use the same formatting as committed source files.
& pnpm --dir $repoRoot exec biome format --write (Join-Path $compatibilityDir 'plugin.json') (Join-Path $pluginRoot '.mcp.json')
if ($LASTEXITCODE -ne 0) { throw 'Could not format generated plugin metadata.' }

# A small, explicit inventory prevents unrelated files and secrets entering uploads.
$expectedFiles = @(
	'plugin.json', 'mcp.json', '.mcp.json', '.codex-plugin/plugin.json',
	'skills/whiteboard/SKILL.md', 'assets/logo.png', 'assets/logo-dark.png', 'LICENSE', 'README.md'
)
$files = @(Get-ChildItem -LiteralPath $pluginRoot -Recurse -Force -File)
foreach ($item in @(Get-Item -LiteralPath $pluginRoot) + @(Get-ChildItem -LiteralPath $pluginRoot -Recurse -Force)) {
	if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Plugin must not contain links.' }
}
$actualFiles = @($files | ForEach-Object { $_.FullName.Substring($pluginRoot.Length + 1).Replace('\', '/') })
if (Compare-Object ($expectedFiles | Sort-Object) ($actualFiles | Sort-Object)) {
	throw 'Plugin inventory differs from the expected public package.'
}
if ($manifest.PSObject.Properties.Name -contains 'apps' -or $openai.PSObject.Properties.Name -contains 'apps') {
	throw 'Public upload must not contain app bindings.'
}
foreach ($field in @('logo', 'composerIcon', 'logoDark', 'composerIconDark')) {
	$relativePath = $openai.interface.$field
	if ($relativePath -notmatch '^\./assets/[a-z-]+\.png$') { throw "Invalid asset path: $field" }
	$bytes = [System.IO.File]::ReadAllBytes((Join-Path $pluginRoot $relativePath))
	if ($bytes.Length -gt 5MB -or [BitConverter]::ToString($bytes, 0, 8) -ne '89-50-4E-47-0D-0A-1A-0A') {
		throw "Invalid PNG: $field"
	}
	$width = ($bytes[16] * 16777216) + ($bytes[17] * 65536) + ($bytes[18] * 256) + $bytes[19]
	$height = ($bytes[20] * 16777216) + ($bytes[21] * 65536) + ($bytes[22] * 256) + $bytes[23]
	if ($width -ne $height -or $width -lt 256 -or $width -gt 4096) { throw "Invalid icon dimensions: $field" }
}

$outputDir = Join-Path $repoRoot '.codex-artifacts/plugins'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$archivePath = Join-Path $outputDir "skedra-$($manifest.version).zip"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
	foreach ($file in $files) {
		$relativePath = $file.FullName.Substring($pluginRoot.Length + 1).Replace('\', '/')
		[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, "skedra/$relativePath") | Out-Null
	}
} finally { $archive.Dispose(); $stream.Dispose() }

# Verify the archive itself, including hidden compatibility files and byte contents.
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
	$expectedEntries = @($expectedFiles | ForEach-Object { "skedra/$_" })
	if (Compare-Object ($expectedEntries | Sort-Object) ($archive.Entries.FullName | Sort-Object)) {
		throw 'ZIP inventory verification failed.'
	}
	foreach ($entry in $archive.Entries) {
		$entryStream = $entry.Open()
		$memory = [System.IO.MemoryStream]::new()
		try {
			$entryStream.CopyTo($memory)
			$sourceBytes = [System.IO.File]::ReadAllBytes((Join-Path $pluginRoot $entry.FullName.Substring(7)))
			if ([Convert]::ToBase64String($sourceBytes) -ne [Convert]::ToBase64String($memory.ToArray())) {
				throw "ZIP content mismatch: $($entry.FullName)"
			}
		} finally { $memory.Dispose(); $entryStream.Dispose() }
	}
} finally { $archive.Dispose() }
Write-Output "Verified package: $archivePath"
if (-not $openai.review.demo_recording_url) {
	Write-Output 'Preparation remains incomplete: add a verified demo recording URL and run the review cases before public submission.'
}
