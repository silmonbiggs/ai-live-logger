Add-Type -AssemblyName System.Windows.Forms,System.Drawing

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen(0, 0, 0, 0, $bounds.Size)
$bitmap.Save("$PWD\screenshot.png")
$bitmap.Dispose()
$graphics.Dispose()

Write-Host "Screenshot saved to screenshot.png"