import { Suspense } from 'react';
import { LoginForm } from '@/components/AuthForms';

export const metadata = { title: 'Sign in - Campus Lost & Found' };

export default function LoginPage() {
  return (
    <div className="stack">
      <div>
        <h1>Sign in</h1>
        <p className="muted mt-0">Use your college email and password.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
