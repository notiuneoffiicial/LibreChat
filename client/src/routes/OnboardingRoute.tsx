import { useCallback, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import OnboardingWizard from '~/components/Onboarding/OnboardingWizard';
import SplashScreen from '~/components/Onboarding/SplashScreen';
import { useAuthContext } from '~/hooks';
import { useOnboardingStatus } from '~/hooks/useOnboardingStatus';

const OnboardingRoute = () => {
  const { user, isAuthenticated } = useAuthContext();
  const ready = isAuthenticated && user !== undefined;
  const { status, isComplete, markComplete } = useOnboardingStatus(user?.id, { enabled: ready });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    const timeout = window.setTimeout(() => {
      navigate('/login', { replace: true, state: { from: location } });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [isAuthenticated, navigate, location]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (status === 'complete') {
      // Use the stored intended redirect path, or fall back to '/c/new'
      const intendedPath = sessionStorage.getItem('intendedRedirectPath') || '/c/new';
      sessionStorage.removeItem('intendedRedirectPath');
      navigate(intendedPath, { replace: true });
    }
  }, [ready, status, navigate]);

  const handleComplete = useCallback(async () => {
    markComplete();
    await Promise.resolve();
    // Use the stored intended redirect path, or fall back to '/c/new'
    const intendedPath = sessionStorage.getItem('intendedRedirectPath') || '/c/new';
    sessionStorage.removeItem('intendedRedirectPath');
    navigate(intendedPath, { replace: true });
  }, [markComplete, navigate]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!ready || status === 'unknown') {
    return <SplashScreen />;
  }

  if (isComplete) {
    // Use the stored intended redirect path, or fall back to '/c/new'
    const intendedPath = sessionStorage.getItem('intendedRedirectPath') || '/c/new';
    sessionStorage.removeItem('intendedRedirectPath');
    return <Navigate to={intendedPath} replace state={{ from: location }} />;
  }

  return <OnboardingWizard onComplete={handleComplete} />;
};

export default OnboardingRoute;

