# Seerr

## Documentation

- [Using Seerr](https://github.com/seerr-team/seerr/tree/develop/docs/using-seerr) — the upstream guide to Seerr's settings, users, requests and notification agents.

## What you get on StartOS

Seerr works with a Jellyfin server, either on this StartOS or on another one. Anyone with a Seerr account can browse every movie and TV show on TMDB and request what they want. You approve requests, and Seerr marks a request available once the title shows up in a Jellyfin library. Seerr doesn't download anything itself. With Radarr (movies) or Sonarr (TV) on this server, it sends approved requests to them to download; without them, you add the requested title to Jellyfin yourself.

## Getting set up

1. Make sure Jellyfin is running and its own setup is finished, with an administrator account for you.
2. Run **Connect Jellyfin**.
   - Under **Jellyfin Server**, keep **This server**, or choose **Another server** and give its address. For Jellyfin on another StartOS, open Jellyfin's interface on that server, copy its HTTPS LAN address, and replace the `.local` name with that server's IP address, for example `https://192.168.1.50:49193`. Give that server a fixed IP address in your router so the address keeps working. Then download that server's Root CA from **About this Server** on that server, open the file in a text editor such as TextEdit or Notepad, and paste all of it into **Root CA**. An address with a public certificate, such as a domain of your own, needs no Root CA. An `http://` address also works, but sends everyone's Jellyfin password unencrypted.
   - Enter your own Jellyfin administrator username and password. That account becomes Seerr's owner.
3. Start Seerr, open the **Web UI**, and sign in with the same Jellyfin account.
4. In Seerr, open **Settings → General** and set **Application URL** to the address you use to reach Seerr. Notification links point there.
5. Open **Settings → Jellyfin** and set **External URL** to the address people use to open Jellyfin, so **Play on Jellyfin** links work.

The Jellyfin server you choose can't be changed later. Moving Seerr to a different Jellyfin server means uninstalling and setting it up again. For Jellyfin on another server, if that server's IP address, Jellyfin's port there, or that server's Root CA changes, stop Seerr and run **Update Jellyfin Address**.

## Using Seerr

### The owner and admins

The owner is the account that ran **Connect Jellyfin**. It can't be deleted, and only the owner can remove other admins. Seerr also reads your Jellyfin libraries through the owner's Jellyfin account, so keep that account in Jellyfin.

To make someone else an admin, open **Users**, choose **Edit User Permissions** for them, and turn on **Admin**. They don't need to be a Jellyfin administrator.

### Adding family and friends

- Anyone with a Jellyfin account on your Jellyfin server can sign in to Seerr with it. Seerr creates their account the first time they sign in. To set someone's permissions before then, add them with **Users → Import Jellyfin Users**. To allow only imported users, turn off **Enable New Jellyfin Sign-In** under **Settings → Users**.
- People without a Jellyfin account get a Seerr account under **Users → Create Local User**. They sign in with **Use your Seerr account**, using that email address and password.

New users can request titles, and their requests wait for your approval. Change what they're allowed to do on each user's page, or set the defaults under **Settings → Users**.

### Signing in while Jellyfin is down

Signing in with a Jellyfin account needs Jellyfin running. For Jellyfin on another server, the **Jellyfin** health check on Seerr's page shows whether Seerr can reach it. To have a way in without Jellyfin, open your profile's **Settings → Password** and set a Seerr password. You can then sign in with **Use your Seerr account**, using your email address, or your Jellyfin username if you haven't added an email address.

### Sending requests to Radarr and Sonarr

1. Install Radarr, Sonarr or both, and finish their setup, including a library folder under **Settings → Media Management → Root Folders** in each.
2. In Jellyfin, add a library for each of those folders: **Movies** for Radarr's, **Shows** for Sonarr's. Then switch each new library on in Seerr, as under **New Jellyfin libraries** below.
3. Run **Connect Radarr and Sonarr** and tick the apps to connect.

Approved requests then go straight to the app, which finds and downloads the title and moves it into its library folder. Seerr marks the request available once Jellyfin's next library scan finds it. Jellyfin scans every 12 hours; to pick a download up sooner, run **Scan All Libraries** in Jellyfin's dashboard.

Each app gets the HD-1080p quality profile (or its first) and its first library folder. Change them under **Settings → Services** in Seerr. To stop sending requests to an app, run **Connect Radarr and Sonarr** again and untick it; what it already received stays in the app.

### Getting notified about requests

- **ntfy**: install ntfy, then run **Connect ntfy** with a topic name. Seerr publishes to that topic whenever a request needs your approval or is approved automatically. In ntfy, give your own ntfy user read access to the topic, then subscribe to it in the ntfy app. **Disconnect ntfy** stops it.
- **Email**: run **Configure SMTP** to let Seerr send email. While email is on, Seerr asks everyone without an email address in their profile, you included, to add one. Each user then turns on the notifications they want under their profile's **Settings → Notifications**. Email also lets Seerr send password resets, and generate and email a password when you create a local user.

Seerr's other notification agents (Discord, Telegram, Pushover, web push and more) are under **Settings → Notifications** in Seerr and need nothing from StartOS. Change which events ntfy reports under **Settings → Notifications → ntfy**.

### New Jellyfin libraries

A library you add to Jellyfin later stays off in Seerr until you open **Settings → Jellyfin**, click **Sync Libraries**, and switch it on.

## Limitations

- Email settings come from **Configure SMTP**. Changes made under **Settings → Notifications → Email** in Seerr are replaced the next time Seerr starts.
- **Connect Radarr and Sonarr** connects the apps on this server only. Radarr or Sonarr elsewhere, or a second one for 4K, are added under **Settings → Services** in Seerr.
- Jellyfin on another server can't be reached by a `.local` name or a Tor address.
- Uninstalling Seerr deletes the API key it created in Jellyfin. If Jellyfin can't be reached at the time, the key stays: delete the API key named **Seerr** in Jellyfin's dashboard.
