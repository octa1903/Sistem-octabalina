import { useAuth } from '@/hooks/useAuth';
import { LoginScreen } from '@/components/LoginScreen';
import { EmployeeApp } from '@/components/employee/Layout';
import { ClientApp } from '@/components/client/Layout';

export default function App() {
  const auth = useAuth();

  if (!auth.isAuthenticated || auth.sessionType === null) {
    return <LoginScreen auth={auth} />;
  }
  if (auth.sessionType === 'employee') {
    return <EmployeeApp auth={auth} />;
  }
  return <ClientApp auth={auth} />;
}
