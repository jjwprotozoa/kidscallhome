# Kids Call Home

A family communication app that helps parents and children stay connected through simple video calls and messaging.

**Domain**: https://www.kidscallhome.com

**Lovable Project URL**: https://lovable.dev/projects/2e0bb7b7-ec23-4451-b444-265fa544e4b5

## About

Kids Call Home is a safe and secure platform for family communication. Parents can create accounts, add their children, and manage access. Children can use a special code to easily initiate video calls and send messages to their parents, keeping families connected anytime, anywhere.

## Authentication Flow

### Parent Authentication
Parents sign up with email and password. Upon registration, each parent account is automatically assigned a unique **Family Code** (6-character alphanumeric code). This family code is shared with all children in the family.

### Child Authentication
Children log in using a three-part code system:
1. **Family Code** - The 6-character code assigned to their family (e.g., "ABC123")
2. **Color or Animal** - A visual selection (e.g., "blue" or "cat")
3. **Number** - A number between 1-99

**Full Login Format**: `familyCode-color/animal-number`  
**Example**: `ABC123-blue-19` or `ABC123-cat-7`

This multi-part authentication system:
- Dramatically reduces accidental cross-account logins
- Improves scalability by isolating families
- Maintains child-friendly simplicity with visual selections
- Ensures each family code is unique across the platform

## Device Management

Parents can view and manage all devices authorized to access their family account through the Device Management page (`/parent/devices`). Features include:

- **Automatic Device Tracking**: Devices are tracked when parents or children log in
- **Device Details**: View device name, type, last login time, IP address, and which child used it
- **Device Management**: Rename devices for easy recognition or remove devices for security
- **Security**: Device removal requires password re-authentication
- **Visual Indicators**: Stale devices (unused for 30+ days) are highlighted

See `docs/DEVICE_MANAGEMENT.md` for detailed documentation.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/2e0bb7b7-ec23-4451-b444-265fa544e4b5) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/2e0bb7b7-ec23-4451-b444-265fa544e4b5) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
