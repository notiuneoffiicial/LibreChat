import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import SplashScreen from '~/components/Onboarding/SplashScreen';
import { useAuthContext } from '~/hooks';
import { useOnboardingStatus } from '~/hooks/useOnboardingStatus';

const OnboardingGate = () => {
  const { user, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const { status, isComplete } = useOnboardingStatus(user?.id, {
    enabled: isAuthenticated && user !== undefined,
  });
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    const timeout = window.setTimeout(() => {
      navigate('/login', { replace: true, state: { from: location } });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [isAuthenticated, navigate, location]);

  if (!isAuthenticated) {
    return <SplashScreen />;
  }

  if (user === undefined || status === 'unknown') {
    return <SplashScreen />;
  }

  if (!isComplete) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default OnboardingGate;

