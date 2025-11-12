import { Navigate, Outlet, useLocation } from 'react-router-dom';
import SplashScreen from '~/components/Onboarding/SplashScreen';
import { useAuthContext } from '~/hooks';
import { useOnboardingStatus } from '~/hooks/useOnboardingStatus';

const OnboardingGate = () => {
  const { user, isAuthenticated } = useAuthContext();
  const { status, isComplete } = useOnboardingStatus(user?.id, {
    enabled: isAuthenticated && user !== undefined,
  });
  const location = useLocation();

  if (!isAuthenticated || user === undefined || status === 'unknown') {
    return <SplashScreen />;
  }

  if (!isComplete) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default OnboardingGate;

