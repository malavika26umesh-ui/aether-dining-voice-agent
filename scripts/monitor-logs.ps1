# Live session log monitor — polls logs/sessions/*.jsonl every 500ms
# and prints new lines as they arrive. Each line is a JSON event.

$logDir = "D:\VoiceAgentDemo\logs\sessions"
$seen   = @{}   # filename -> line count already printed

Write-Host "=== TableVoice Log Monitor ===" -ForegroundColor Cyan
Write-Host "Watching: $logDir" -ForegroundColor DarkGray
Write-Host "---" -ForegroundColor DarkGray

while ($true) {
  if (Test-Path $logDir) {
    $files = Get-ChildItem $logDir -Filter "*.jsonl" -ErrorAction SilentlyContinue

    foreach ($f in $files) {
      if (-not $seen.ContainsKey($f.Name)) {
        $seen[$f.Name] = 0
        Write-Host ""
        Write-Host ">>> NEW SESSION: $($f.BaseName)" -ForegroundColor Yellow
        Write-Host "---" -ForegroundColor DarkGray
      }

      $lines = Get-Content $f.FullName -ErrorAction SilentlyContinue
      if ($lines -and $lines.Count -gt $seen[$f.Name]) {
        $newLines = if ($lines.Count -eq 1) { @($lines) } else { $lines[$seen[$f.Name]..($lines.Count-1)] }
        foreach ($line in $newLines) {
          try {
            $ev = $line | ConvertFrom-Json
            $ts  = if ($ev.ts) { ([datetime]$ev.ts).ToString("HH:mm:ss.fff") } else { "??:??:??" }
            $evt = $ev.event

            # Colour-code by event type
            $color = switch ($evt) {
              "session_start"       { "Green" }
              "session_end"         { "DarkGray" }
              "user_turn"           { "Cyan" }
              "agent_turn"          { "White" }
              "stt_result"          { "DarkCyan" }
              "guardrail_fired"     { "Magenta" }
              "error"               { "Red" }
              "mcp_call"            { "Yellow" }
              "code_issued"         { "Green" }
              "audio_too_short"     { "DarkYellow" }
              "low_confidence"      { "DarkYellow" }
              "silence_nudge"       { "DarkGray" }
              "silence_timeout"     { "DarkGray" }
              "barge_in"            { "Magenta" }
              "intent_detected"     { "DarkCyan" }
              default               { "Gray" }
            }

            # Format each event clearly
            $detail = switch ($evt) {
              "session_start"    { "resumed=$($ev.data.resumed)" }
              "session_end"      { "reason=$($ev.data.reason) | turns=$($ev.data.turns) | duration=$($ev.data.durationMs)ms" }
              "stt_result"       { "conf=$($ev.data.confidence) | bytes=$($ev.data.audioBytes) | latency=$($ev.data.latencyMs)ms | `"$($ev.data.transcript)`"" }
              "user_turn"        { "turn=$($ev.data.turnNum) | intent=$($ev.data.intent) | `"$($ev.data.transcript)`"" }
              "agent_turn"       { "turn=$($ev.data.turnNum) | latency=$($ev.data.totalLatencyMs)ms | `"$($ev.data.responseText.Substring(0, [Math]::Min(80, $ev.data.responseText.Length)))`"..." }
              "intent_detected"  { "intent=$($ev.data.intent) | conf=$($ev.data.confidence) | latency=$($ev.data.latencyMs)ms" }
              "guardrail_fired"  { "rule=$($ev.data.rule) | input=`"$($ev.data.input.Substring(0, [Math]::Min(60, $ev.data.input.Length)))`"" }
              "mcp_call"         { "op=$($ev.data.operation) | ok=$($ev.data.success) | latency=$($ev.data.latencyMs)ms | attempt=$($ev.data.attempt)" }
              "code_issued"      { "code=$($ev.data.code) | $($ev.data.occasion) | $($ev.data.date) $($ev.data.time)" }
              "error"            { "stage=$($ev.data.stage) | $($ev.data.message)" }
              "audio_too_short"  { "bytes=$($ev.data.bytes)" }
              "low_confidence"   { "conf=$($ev.data.confidence) | `"$($ev.data.transcript)`"" }
              "barge_in"         { "agent_was_saying=`"$($ev.data.agentWasSaying.Substring(0, [Math]::Min(60, $ev.data.agentWasSaying.Length)))`"" }
              "silence_nudge"    { "elapsed=$($ev.data.elapsedMs)ms" }
              "silence_timeout"  { "elapsed=$($ev.data.elapsedMs)ms" }
              default            { $line }
            }

            Write-Host "[$ts] $($evt.PadRight(20)) $detail" -ForegroundColor $color
          } catch {
            Write-Host $line -ForegroundColor DarkGray
          }
        }
        $seen[$f.Name] = $lines.Count
      }
    }
  }
  Start-Sleep -Milliseconds 500
}
