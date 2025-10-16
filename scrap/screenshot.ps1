Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$bmp = New-Object Drawing.Bitmap([Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)
$graphics = [Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen([Windows.Forms.Screen]::PrimaryScreen.Bounds.X, [Windows.Forms.Screen]::PrimaryScreen.Bounds.Y, 0, 0, $bmp.Size)
$bmp.Save("C:\dev\chatgpt-live-logger\screenshot.png")
$graphics.Dispose()
$bmp.Dispose()
Write-Host "Screenshot saved to screenshot.png"