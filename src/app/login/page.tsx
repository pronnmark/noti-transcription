'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        toast.success('Welcome to Noti!');
        router.push('/');
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Invalid password');
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-light tracking-tight text-foreground">Noti</h1>
            <p className="text-muted-foreground text-sm">
              AI-powered audio transcription with speaker diarization
            </p>
          </div>

          {/* Login Form */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                    className="h-12 text-base"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? 'Logging in...' : 'Continue'}
                </Button>
              </form>

              <div className="mt-6 text-center text-xs text-muted-foreground">
                <p>Contact your administrator for access</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
