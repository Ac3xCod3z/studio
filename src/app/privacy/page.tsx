
import { Logo } from '@/components/icons';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background min-h-screen">
      <header className="py-4 px-4 md:px-6 border-b">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <Logo />
        </Link>
      </header>
      <main className="max-w-4xl mx-auto py-12 px-4 md:px-6">
        <div className="space-y-8 text-foreground">
          <h1 className="text-4xl font-bold">Privacy Policy for Centsei</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Introduction</h2>
            <p>
              Welcome to Centsei ("we," "us," or "our"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application. By using Centsei, you agree to the collection and use of information in accordance with this policy.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Information We Collect</h2>
            <p>
              Centsei is designed to be privacy-focused. Your financial data is primarily stored on your own device.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Locally Stored Data:</strong> All financial entries (bills, income, etc.) that you create are stored exclusively in your browser's local storage. We do not have a server, and we do not see, collect, or store this data. It remains on your computer or device.
              </li>
              <li>
                <strong>Google Calendar Integration:</strong> If you choose to connect your Google Account, we will request permission to access and create events in your Google Calendar. This is solely for the purpose of syncing your financial entries as calendar events. We do not store your Google account information, other than what is necessary for the authentication session. The management of that data is subject to Google's Privacy Policy.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">How We Use Your Information</h2>
            <p>
              We use the information we access for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and maintain the core functionality of the Centsei application.</li>
              <li>To allow you to sync your financial entries with your Google Calendar, if you choose to enable this feature.</li>
              <li>To enable AI-powered features within the app, which process your input to provide recommendations. This data is not stored long-term.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Data Storage and Security</h2>
            <p>
              Your personal financial data is stored on your device's local storage and is not transmitted to us. Data shared with Google for Calendar synchronization is handled according to Google's security practices. We recommend using a secure device and browser to protect your local data.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Third-Party Services</h2>
            <p>
              Our service relies on Google for authentication and calendar integration. We are not responsible for the privacy practices of Google. We encourage you to review their privacy policy.
            </p>
            <ul className="list-disc list-inside">
                <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Privacy Policy</a></li>
            </ul>
          </div>
          
           <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Contact Us</h2>
            <p>
                If you have any questions about this Privacy Policy, you can contact us through the support channels provided by Firebase Studio.
            </