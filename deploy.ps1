# EchoWire One-Click Deploy Script
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "       EchoWire Auto-Deploy Script            " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

Write-Host "`n[1/3] Building Frontend with Vite..." -ForegroundColor Yellow
pnpm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Build failed! Please check errors above." -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/3] Committing and pushing all changes to GitHub..." -ForegroundColor Yellow
git add -A
git commit -m "deploy: update live application"
git push origin main

Write-Host "`n[3/3] Deploying directly to Vercel..." -ForegroundColor Yellow
npx vercel --prod

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host "🎉 DEPLOYMENT FINISHED!" -ForegroundColor Green
Write-Host "Backend:  https://echowire-2pw0.onrender.com" -ForegroundColor Green
Write-Host "Frontend: https://echowire.vercel.app" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
