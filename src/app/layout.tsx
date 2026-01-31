
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/context/AuthContext';
import { UserProvider } from '@/context/UserDataContext';
import { PermissionsProvider } from '@/context/PermissionsContext';
import { ActivityLogProvider } from '@/context/ActivityLogContext';
import { PropertyProvider } from '@/context/PropertyDataContext';
import { BopProvider } from '@/context/BopDataContext';
import { SummaryBillProvider } from '@/context/SummaryBillContext';
import { BillProvider } from '@/context/BillDataContext';

export const metadata: Metadata = {
  title: 'RateEase',
  description: 'Revenue Mobilization for District Assemblies',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Tinos:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <UserProvider>
            <AuthProvider>
              <PermissionsProvider>
                <ActivityLogProvider>
                  <PropertyProvider>
                    <BopProvider>
                      <SummaryBillProvider>
                        <BillProvider>
                          {children}
                          <Toaster />
                        </BillProvider>
                      </SummaryBillProvider>
                    </BopProvider>
                  </PropertyProvider>
                </ActivityLogProvider>
              </PermissionsProvider>
            </AuthProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
