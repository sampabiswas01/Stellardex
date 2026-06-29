# Submission Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Public GitHub repository | ✅ | https://github.com/sampabiswas01/Stellardex |
| README with complete documentation | ✅ | [README.md](./README.md) |
| 10+ meaningful commits | ✅ | `git log` on `main` |
| Live demo link | ⏳ | Deploy frontend to Vercel — see below |
| Contract deployment address | ✅ | [DEPLOYMENT.md](./DEPLOYMENT.md) — Pool `CDV2ERHHD5JH3NBUCSKTMVQ6MTE5KP4GRGH7RHZHNLASS3YBZS6CUTRC` |
| Transaction hash for contract interaction | ✅ | [DEPLOYMENT.md](./DEPLOYMENT.md) — e.g. pool `initialize` `6f22cea5508276e9a2de4f26626dc2eef69a79ea883a5a0dff565b7bbc7cf433` |
| Test output (3+ passing tests) | ✅ | [docs/contract-test-output.txt](./docs/contract-test-output.txt) — 13 passing (9 pool + 4 token) |
| CI/CD pipeline | ✅ | [.github/workflows](./.github/workflows) — runs on push (screenshot from Actions tab) |
| Mobile responsive UI | ✅ | Tailwind responsive layout (`/`, `/swap`, `/wallet`) — screenshot from live demo |

## Remaining manual steps (need your accounts)

### Live demo (Vercel)
```bash
cd frontend
npm i -g vercel
vercel --prod   # follow prompts; set the NEXT_PUBLIC_* env vars from DEPLOYMENT.md
```
Then add the resulting URL to this file and the README.

### Screenshots
Capture and add to a `docs/screenshots/` folder:
1. **Mobile responsive UI** — open the live site (or `npm run dev`) in a mobile viewport (DevTools device toolbar) and screenshot `/swap` and `/wallet`.
2. **CI/CD running** — GitHub repo → **Actions** tab → the latest CI run with green checks.
3. **Test output** — already captured as text in `docs/contract-test-output.txt`; optionally screenshot the Actions `contracts` job log.
