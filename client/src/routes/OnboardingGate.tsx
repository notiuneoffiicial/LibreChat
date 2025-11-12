import { Navigate, Outlet, useLocation } from 'react-router-dom';
import SplashScreen from '~/components/Onboarding/SplashScreen';
import { useOnboardingStatus } from '~/hooks/useOnboardingStatus';

const OnboardingGate = () => {
  const { status, isComplete } = useOnboardingStatus();
  const location = useLocation();

  if (status === 'unknown') {
    return <SplashScreen />;
  }

  if (!isComplete) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default OnboardingGate;

