@echo off
echo Pushing changes to GitHub...
git add .
git commit -m "Automated update"
git push
echo Push complete!
pause
