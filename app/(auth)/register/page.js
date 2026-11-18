import { RegisterForm } from '@/components/AuthForms';
import { query } from '@/lib/db';

export const metadata = { title: 'Register - Campus Lost & Found' };
export const dynamic = 'force-dynamic';   // reads departments from MySQL at request time

export default async function RegisterPage() {
  const departments = await query('SELECT dept_id, dept_name FROM departments ORDER BY dept_name');
  return (
    <div className="stack">
      <div>
        <h1>Create a student account</h1>
        <p className="muted mt-0">Staff and admin roles are assigned by an administrator.</p>
      </div>
      <RegisterForm departments={departments} />
    </div>
  );
}
