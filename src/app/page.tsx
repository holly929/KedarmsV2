'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Landmark, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { store } from '@/lib/store';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading, login } = useAuth();
  
  const [systemName, setSystemName] = React.useState('RateEase');
  const [assemblyLogo, setAssemblyLogo] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('admin@rateease.gov');
  const [password, setPassword] = React.useState('password');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  React.useEffect(() => {
    const generalSettings = store.settings.generalSettings;
    const appearanceSettings = store.settings.appearanceSettings;

    if (generalSettings && generalSettings.systemName) {
      setSystemName(generalSettings.systemName);
    }
    if (appearanceSettings && appearanceSettings.assemblyLogo) {
      setAssemblyLogo(appearanceSettings.assemblyLogo);
    }
  }, []);
  
  React.useEffect(() => {
    if (!loading && user) {
        router.replace('/dashboard');
    }
  }, [user, loading, router]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    const success = await login(email, password);

    if (success) {
      toast({
        title: 'Login Successful',
        description: `Welcome back!`,
      });
      router.push('/dashboard');
    } else {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid email or password. Please try again.',
      });
       setIsLoggingIn(false);
    }
  };

  if(loading || (!loading && user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
       <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/20 via-background to-background dark:from-primary/10 animate-gradient-xy"></div>
       <div className="relative z-10 w-full max-w-md">
        <Card className="shadow-2xl animate-fade-in-up bg-card/80 backdrop-blur-lg">
          <CardHeader className="text-center p-6">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center text-primary overflow-hidden">
               {assemblyLogo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={assemblyLogo} alt="Assembly Logo" style={{height: '100%', width: '100%', objectFit: 'contain'}} />
              ) : (
                <Landmark className="h-12 w-12" />
              )}
            </div>
            <CardTitle className="font-headline text-3xl">{systemName}</CardTitle>
            <CardDescription>District Assembly Revenue Mobilization</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6 px-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoggingIn}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoggingIn}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="px-6 pb-6 pt-4">
              <Button type="submit" className="w-full" size="lg" disabled={isLoggingIn}>
                {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground animate-fade-in-up animation-delay-300">
          BUILT AND DEVELOPED BY ANEH TECH CONSORTIUM.
        </p>
      </div>
    </main>
  );
}
