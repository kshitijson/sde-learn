# Hosting This Website on GitHub Pages

This site is plain HTML, CSS and JavaScript, so GitHub Pages can serve it as-is: no build step needed.

## Files

```
.
├── index.html   # the page (GitHub Pages serves this at the root URL)
├── style.css    # styles, including dark mode
├── script.js    # theme toggle, mobile menu, contact form
└── HOSTING.md   # this guide
```

## Prerequisites

- A free GitHub account: <https://github.com/signup>
- Git installed. Check with `git --version`. On macOS, running it will prompt you to install the Command Line Tools if it's missing.

## Step 1: Preview locally (optional)

Open `index.html` directly in your browser, or run a small local server:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Step 2: Create a GitHub repository

1. Go to <https://github.com/new>.
2. Choose a repository name:
   - **`<your-username>.github.io`**: the site will live at `https://<your-username>.github.io/`. You can have only one of these per account.
   - **Any other name** (e.g. `my-website`): the site will live at `https://<your-username>.github.io/my-website/`.
3. Set it to **Public**. GitHub Pages is free for public repos; private repos need a paid plan.
4. **Don't** tick "Add a README", so the repo starts empty.
5. Click **Create repository**.

## Step 3: Push the code

In this project folder, run (replace the URL with your repo's URL):

```bash
git init
git add .
git commit -m "Initial website"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

> **Authentication:** GitHub no longer accepts your account password for `git push`. Use one of:
> - The GitHub CLI: `brew install gh`, then `gh auth login`
> - A **Personal Access Token** (Settings → Developer settings → Personal access tokens), pasted when Git asks for a password
> - An SSH key: <https://docs.github.com/en/authentication/connecting-to-github-with-ssh>

**Shortcut with the GitHub CLI.** This creates the repo and pushes in one step:

```bash
git init && git add . && git commit -m "Initial website"
gh repo create <repo-name> --public --source=. --push
```

## Step 4: Turn on GitHub Pages

1. Open your repository on GitHub.
2. Go to **Settings → Pages** (in the left sidebar under "Code and automation").
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`, folder `/ (root)`
4. Click **Save**.

## Step 5: Visit your site

The first deploy takes about 1 to 2 minutes. Refresh the Pages settings page, and the live URL will appear at the top:

```
https://<your-username>.github.io/<repo-name>/
```

To watch the deploy run, open the repo's **Actions** tab and look for "pages build and deployment".

## Updating the site

Edit the files, then:

```bash
git add .
git commit -m "Describe your change"
git push
```

GitHub Pages redeploys automatically on every push to `main`.

## Optional: Use a custom domain

1. In **Settings → Pages → Custom domain**, enter your domain (e.g. `www.example.com`) and save. GitHub adds a `CNAME` file to the repo.
2. At your domain registrar, add DNS records:
   - For `www.example.com`: a **CNAME** record pointing to `<your-username>.github.io`
   - For the bare domain `example.com`: **A** records pointing to
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. After DNS propagates (minutes to a few hours), tick **Enforce HTTPS**.

Docs: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site>

## Troubleshooting

| Problem | Fix |
|---|---|
| **404 "There isn't a GitHub Pages site here"** | Wait a couple of minutes after enabling Pages. Check that the branch/folder in Settings → Pages is `main` / `/ (root)` and that `index.html` sits at the repo root. |
| **Page loads but has no styling** | Paths must be relative (`style.css`, not `/style.css`). A leading `/` breaks on project sites served from `/<repo-name>/`. |
| **Changes don't show up** | Hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) and check the Actions tab for a failed deploy. |
| **`git push` asks for a password and fails** | Use a Personal Access Token or `gh auth login` (see Step 3). |
| **Filename case issues** | GitHub Pages is case-sensitive: `Style.css` ≠ `style.css`. |

## Note on the contact form

GitHub Pages only serves static files, so the contact form can't send email on its own. Right now it just shows a thank-you message. To actually receive messages, point the form at a form service such as [Formspree](https://formspree.io):

```html
<form action="https://formspree.io/f/<your-form-id>" method="POST">
```

Then remove the submit handler in `script.js`.
