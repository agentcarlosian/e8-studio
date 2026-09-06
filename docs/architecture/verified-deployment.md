# Verified GitHub Pages deployment

`.github/workflows/ci.yml` is the entry point for pull requests, pushes to `main`,
and manual runs. Its existing `verify` and `windows-build` checks remain separate
so branch protection can continue requiring them.

The Linux `verify` job runs `release:check`, the mathematical tests, and the
Mobile V2 browser smoke suite. `release:check` already runs the canonical
verifier (including the Vite build and browser tests against `dist/web`), module
contracts, visual-system checks, robustness tests, and standalone artifact tests.
Those checks are not repeated as separate Linux steps. Windows retains its
independent build and contract checks.

After the Linux checks succeed, a push or manual run on `main` uploads that same
`dist/web` directory as the `github-pages` artifact. The deployment job waits for
**both** verification jobs to succeed, then calls the reusable `pages.yml`
workflow. That workflow configures Pages and deploys the artifact from the current
run; it does not check out or rebuild the site.

Pull request jobs have a read-only repository token, do not persist Git credentials,
and cannot upload a Pages artifact or enter the deployment job. Only the deployment
job receives Pages and OIDC write permissions. Main runs finish in sequence;
superseded pull request runs are cancelled. An active Pages deployment is allowed
to complete.

To manually publish, select **Actions → CI → Run workflow → main**. A manual run
on another branch performs verification without publishing. GitHub Pages must
remain configured to use GitHub Actions, and the `github-pages` environment's
protection rules still apply.

The workflow structure follows GitHub's documentation for
[reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
and [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
