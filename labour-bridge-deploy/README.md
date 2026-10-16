# Labour Bridge — deployment package

This package keeps the supplied Labour Bridge interface and removes the visible “demo” wording. It adds an Express API with PostgreSQL storage, password hashing, JWT login, job posting, job applications, contact requests, and reports.

## Before deployment
- You need a GitHub repository.
- Deploy the backend to Render and create a PostgreSQL database (Render PostgreSQL or another PostgreSQL provider).
- Deploy the frontend folder to Vercel.
- This is a starter implementation. The worker directory and dashboard still display some preloaded profile/summary content from the supplied HTML; they are not yet backed by database-driven worker profiles. Do not treat the sample worker profiles or employer verification labels as real verified identities.

## 1. Push the code to GitHub
Extract `labour-bridge-deploy.zip`. Create a GitHub repo, then upload both `frontend` and `backend` folders. Or from the extracted folder:
```bash
git init
git add .
git commit -m "Add Labour Bridge frontend and backend"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## 2. Create PostgreSQL on Render
1. Sign in to https://render.com.
2. Dashboard → New → PostgreSQL.
3. Give it a name, choose a region close to your users, and create it.
4. Open the database page and copy its **Internal Database URL** if the web service is also on Render. Keep the URL private.

## 3. Deploy backend on Render
1. Render Dashboard → New → Web Service → connect your GitHub repository.
2. Set **Root Directory** to `backend`.
3. Runtime: Node.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add environment variables:
   - `DATABASE_URL` = the Render PostgreSQL Internal Database URL
   - `JWT_SECRET` = a long random secret (at least 32 characters; never commit it)
   - `FRONTEND_URL` = your eventual Vercel URL, for example `https://labour-bridge.vercel.app`
   - `NODE_ENV` = `production`
7. Click Deploy. Wait for “Live”.
8. Test `https://YOUR-RENDER-SERVICE.onrender.com/api/health`. Expected JSON: `{"ok":true,"service":"Labour Bridge API"}`.

## 4. Connect frontend to backend
1. Open `frontend/index.html`.
2. Find `https://YOUR-RENDER-SERVICE.onrender.com/api`.
3. Replace it with your actual Render URL followed by `/api`, e.g. `https://labour-bridge-api.onrender.com/api`.
4. Save and push the change to GitHub.

## 5. Deploy frontend on Vercel
1. Sign in to https://vercel.com and click **Add New → Project**.
2. Import the same GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Framework Preset: **Other**.
5. Build Command: leave blank; Output Directory: `.` (or leave the default if Vercel detects the static HTML).
6. Deploy.
7. Copy your Vercel URL. Add that exact URL to Render's `FRONTEND_URL` environment variable (if you change it, update the variable and redeploy/restart the Render service).
8. If you had used a temporary Vercel URL in `FRONTEND_URL`, replace it with your final production domain.

## 6. Verify the app
- Open the Vercel website.
- Create an account with a 10-digit mobile number and a password of at least 8 characters.
- Register one account as **Employer** and post a job.
- Register another account as **Worker** and apply to a job.
- Submit a report and test the health endpoint.
- Check Render logs if an API request fails.

## Important limitations / production hardening
- The provided sample jobs are inserted into PostgreSQL on first startup; you can replace or remove them from the database.
- New job posts require an employer login; applications and contact requests require a worker/employer login as enforced by the API.
- Reports can be submitted without login to allow safety reports.
- The frontend's demo dashboard metrics and sample worker profiles are not fully database-backed yet. This package connects the main jobs, account, application, report, and contact flows.
- Add OTP verification, password reset, privacy policy, admin authorization, worker profile storage, real employer verification, audit logging, and a proper privacy/security review before handling real users at scale.
- Render free web services may sleep when idle; first request after inactivity can be slow. Persistent data must live in PostgreSQL, not local files.
