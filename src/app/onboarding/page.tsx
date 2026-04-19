'use client';

import { useState, useEffect } from 'react';

// Force dynamic rendering for this page since it requires authentication
export const dynamic = 'force-dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sparkles, ArrowRight, BarChart3, TrendingUp, HeadphonesIcon, PieChart, Check, ChevronRight, Loader2 } from 'lucide-react';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { TemplateGallery } from '@/components/onboarding/TemplateGallery';
import { FirstDashboardGuide } from '@/components/onboarding/FirstDashboardGuide';
import Link from 'next/link';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showModal, setShowModal] = useState(true);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'templates' | 'guided' | 'complete'>('welcome');
  const [isCompleting, setIsCompleting] = useState(false);

  // Redirect if user is already onboarded
  useEffect(() => {
    if (status === 'authenticated' && session?.user && (session.user as any).hasOnboarded) {
      router.push('/');
    }
  }, [session, status, router]);

  // Show loading while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-accent-blue" />
          <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const handleCompleteOnboarding = async () => {
    setIsCompleting(true);
    try {
      const response = await fetch('/api/user/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Force session refresh to update hasOnboarded flag
        window.location.href = '/';
      } else {
        console.error('Failed to complete onboarding');
        setIsCompleting(false);
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsCompleting(false);
    }
  };

  const steps = [
    { id: 'welcome', label: 'Welcome', completed: currentStep !== 'welcome' },
    { id: 'templates', label: 'Templates', completed: currentStep === 'guided' || currentStep === 'complete' },
    { id: 'guided', label: 'First Dashboard', completed: currentStep === 'complete' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <Link href="/" className="flex items-center gap-2 text-accent-blue font-bold text-lg tracking-tight">
              <Sparkles size={20} />
              <span>InsightHub</span>
            </Link>
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    step.completed
                      ? 'bg-accent-green/10 text-accent-green'
                      : currentStep === step.id
                        ? 'bg-accent-blue/10 text-accent-blue'
                        : 'text-[var(--text-muted)]'
                  }`}>
                    {step.completed ? (
                      <Check size={12} />
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-current opacity-30" />
                    )}
                    {step.label}
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight size={12} className="text-[var(--text-muted)] mx-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pt-24 pb-8">
        {currentStep === 'welcome' && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
                Welcome to InsightHub! 🎉
              </h1>
              <p className="text-lg text-[var(--text-secondary)] mb-8">
                Let's get you set up with everything you need to create amazing dashboards.
              </p>
              <button
                onClick={() => setCurrentStep('templates')}
                className="px-6 py-3 rounded-xl bg-accent-blue text-white font-medium hover:bg-accent-blue/90 transition-colors flex items-center gap-2 mx-auto"
              >
                Get Started
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'templates' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <TemplateGallery onNext={() => setCurrentStep('guided')} />
          </div>
        )}

        {currentStep === 'guided' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <FirstDashboardGuide
              onNext={() => setCurrentStep('complete')}
              onSkip={() => setCurrentStep('complete')}
            />
          </div>
        )}

        {currentStep === 'complete' && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <div className="mb-8">
              <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto mb-6">
                <Check size={32} className="text-accent-green" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
                You're All Set!
              </h1>
              <p className="text-lg text-[var(--text-secondary)] mb-8">
                You now have everything you need to create powerful, insightful dashboards. Let's build something amazing!
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={isCompleting}
                  className="px-6 py-3 rounded-xl bg-accent-blue text-white font-medium hover:bg-accent-blue/90 transition-colors flex items-center gap-2 justify-center disabled:opacity-50"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Finishing Setup...
                    </>
                  ) : (
                    <>
                      Start Creating
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
                <Link
                  href="/dashboards"
                  className="px-6 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-card-hover)] transition-colors flex items-center gap-2 justify-center"
                >
                  Browse Templates
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Welcome modal */}
      {showModal && currentStep === 'welcome' && (
        <WelcomeModal onClose={() => setShowModal(false)} onGetStarted={() => {
          setShowModal(false);
          setCurrentStep('templates');
        }} />
      )}
    </div>
  );
}