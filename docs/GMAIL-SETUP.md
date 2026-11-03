# Connecting Gmail in the demo inbox (site owner only)

The "Connect Gmail" button in the demo inbox stays hidden until the site has a Google sign-in client.
Visitors never see these steps.

1. In Google Cloud Console, create a project and enable the **Gmail API**.
2. Configure the OAuth consent screen (External, "Testing") and add the Gmail addresses that may try it as test users.
3. Create an **OAuth client ID** of type "Web application" with the site's address as an authorised JavaScript origin.
4. Add it in Vercel as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and redeploy.

Mail is read and sent from the visitor's browser with read and send permission only. The access token stays in the open tab.
Public use beyond test users needs Google's app verification for Gmail scopes.
