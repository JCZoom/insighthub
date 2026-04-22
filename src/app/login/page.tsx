'use client';

import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user is already signed in
    getSession().then((session) => {
      if (session) {
        // Redirect based on onboarding status
        const user = session.user as any;
        if (!user.hasOnboarded) {
          router.push('/onboarding');
        } else {
          router.push('/gallery');
        }
      }
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signIn('google', {
        redirect: false,
      });

      if (result?.error) {
        console.error('Sign in error:', result.error);
        alert('Sign in failed. Please make sure you are using a @uszoom.com email address.');
      } else if (result?.ok) {
        // Refresh session to get updated user data
        const session = await getSession();
        if (session) {
          const user = session.user as any;
          if (!user.hasOnboarded) {
            router.push('/onboarding');
          } else {
            router.push('/gallery');
          }
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      alert('An error occurred during sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: 'jeff.coy@uszoom.com',
        redirect: false,
      });

      if (result?.error) {
        console.error('Dev sign in error:', result.error);
      } else if (result?.ok) {
        router.push('/gallery'); // Dev user is always onboarded
      }
    } catch (error) {
      console.error('Dev sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-500/15">
            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
            Sign in to InsightHub
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Access your dashboards and analytics
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-700 rounded-md text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </div>
            </button>
          </div>

          {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-950 text-gray-500">Development only</span>
              </div>
              <button
                onClick={handleDevSignIn}
                disabled={isLoading}
                className="mt-4 group relative w-full flex justify-center py-3 px-4 border border-yellow-600/30 rounded-md text-sm font-medium text-yellow-200 bg-yellow-500/10 hover:bg-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Signing in...' : 'Dev Login (Admin)'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="text-center text-xs text-gray-500">
            <p>
              This app is restricted to @uszoom.com email addresses.
              <br />
              Contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}