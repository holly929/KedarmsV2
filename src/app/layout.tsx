import type {Metadata} from 'next';
import './globals.css';
import { Inter, Space_Grotesk, Tinos, Courier_Prime } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/context/AuthContext';
import { UserProvider } from '@/context/UserDataContext';
import { PermissionsProvider } from '@/context/PermissionsContext';
import { ActivityLogProvider } from '@/context/ActivityLogContext';
import { PropertyProvider } from '@/context/PropertyDataContext';
import { BopProvider } from '@/context/BopDataContext';
import { LicenseProvider } from '@/context/LicenseDataContext';
import { SummaryBillProvider } from '@/context/SummaryBillContext';
import { BillProvider } from '@/context/BillDataContext';
import { SmsLogProvider } from '@/context/SmsLogContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import ErrorBoundary from '@/components/error-boundary';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const tinos = Tinos({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-tinos' });
const courierPrime = Courier_Prime({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-courier' });

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable} ${tinos.variable} ${courierPrime.variable}`}>
      <body className="font-sans antialiased">
        <ErrorBoundary>
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
                        <LicenseProvider>
                          <SummaryBillProvider>
                            <BillProvider>
                              <SmsLogProvider>
                                <TooltipProvider>
                                  {children}
                                  <Toaster />
                                </TooltipProvider>
                              </SmsLogProvider>
                            </BillProvider>
                          </SummaryBillProvider>
                        </LicenseProvider>
                      </BopProvider>
                    </PropertyProvider>
                  </ActivityLogProvider>
                </PermissionsProvider>
              </AuthProvider>
            </UserProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
