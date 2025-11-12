import { useCallback, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import OnboardingWizard from '~/components/Onboarding/OnboardingWizard';
import SplashScreen from '~/components/Onboarding/SplashScreen';
import { useOnboardingStatus } from '~/hooks/useOnboardingStatus';

const OnboardingRoute = () => {
  const { status, isComplete, markComplete } = useOnboardingStatus();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'complete') {
      navigate('/c/new', { replace: true });
    }
  }, [status, navigate]);

  const handleComplete = useCallback(async () => {
    markComplete();
    await Promise.resolve();
    navigate('/c/new', { replace: true });
  }, [markComplete, navigate]);

  if (status === 'unknown') {
    return <SplashScreen />;
  }

  if (isComplete) {
    return <Navigate to="/c/new" replace state={{ from: location }} />;
  }

  return <OnboardingWizard onComplete={handleComplete} />;
};

export default OnboardingRoute;

