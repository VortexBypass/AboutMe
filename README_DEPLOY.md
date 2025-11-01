# Deploy instructions for AFK website

## Quick local test
From the project folder:
```
python -m http.server 8000
# then open http://localhost:8000
```

## Git → GitHub → Vercel (recommended)
1. Initialize git and push:
```
git init
git add .
git commit -m "Initial site"
# create repo on GitHub, then:
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```
2. In Vercel dashboard: New Project → Import Git Repository → choose this repo.
 - Framework Preset: Other
 - Build command: leave empty
 - Output Directory: leave empty
3. Deploy.

## Vercel CLI (alternative)
Install:
```
npm i -g vercel
```
From project folder:
```
vercel
# choose options: link to account, choose no build command / Other
# for production:
vercel --prod
```

## If you see "No files found" or 404:
- Make sure index.html is at repo root.
- Filenames are case-sensitive.
- Ensure you committed and pushed all files.
- Add the vercel.json (included) and redeploy.

## Check logs:
Vercel Dashboard → Project → Deployments → Click deployment → Logs
Paste errors if you still need help.
