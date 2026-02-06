import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { GraduationCap, Users, CheckCircle, ArrowLeft } from 'lucide-react';
import gppLogo from '/gpp-logo.png';

type AccountType = 'student' | 'supervisor';

const departments = [
  { value: 'IT', label: 'Information Technology (IT)' },
  { value: 'CS', label: 'Computer Science (CS)' },
  { value: 'IS', label: 'Information Systems (IS)' },
];

const projectAreas = [
  { value: 'ai-ml', label: 'Artificial Intelligence & Machine Learning' },
  { value: 'web-dev', label: 'Web Development' },
  { value: 'mobile-dev', label: 'Mobile Application Development' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'data-science', label: 'Data Science & Analytics' },
  { value: 'iot', label: 'Internet of Things (IoT)' },
  { value: 'cloud', label: 'Cloud Computing' },
  { value: 'networking', label: 'Networking' },
  { value: 'software-eng', label: 'Software Engineering' },
  { value: 'other', label: 'Other' },
];

const mockSupervisors = [
  { value: 'sup-1', label: 'Dr. Ahmed Al-Harbi' },
  { value: 'sup-2', label: 'Dr. Fatimah Al-Zahrani' },
  { value: 'sup-3', label: 'Dr. Mohammed Al-Ghamdi' },
  { value: 'sup-4', label: 'Dr. Sara Al-Otaibi' },
  { value: 'sup-5', label: 'Dr. Khalid Al-Mutairi' },
];

export function Register() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [submitted, setSubmitted] = useState(false);

  // Student fields
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentConfirmPassword, setStudentConfirmPassword] = useState('');
  const [studentDepartment, setStudentDepartment] = useState('');
  const [projectName, setProjectName] = useState('');
  const [aboutProject, setAboutProject] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [projectArea, setProjectArea] = useState('');

  // Supervisor fields
  const [supervisorFirstName, setSupervisorFirstName] = useState('');
  const [supervisorLastName, setSupervisorLastName] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [supervisorConfirmPassword, setSupervisorConfirmPassword] = useState('');
  const [supervisorDepartment, setSupervisorDepartment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel - Success */}
        <div className="w-1/2 flex items-center justify-center p-12 bg-[var(--color-surface-white)]">
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-[var(--color-text-900)] mb-3">Request Submitted!</h1>
            <p className="text-[var(--color-text-600)] mb-8">
              Your account request has been sent to the admin for approval. You will be notified once your account is activated.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Back to Login
            </Button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] p-12 flex items-center justify-center text-white">
          <div className="max-w-md">
            <h2 className="text-white mb-6">What Happens Next?</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold">1</div>
                <div>
                  <h3 className="text-white mb-1">Admin Review</h3>
                  <p className="text-white/80">The admin will review your registration details</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold">2</div>
                <div>
                  <h3 className="text-white mb-1">Account Activation</h3>
                  <p className="text-white/80">Once approved, your account will be activated</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold">3</div>
                <div>
                  <h3 className="text-white mb-1">Get Started</h3>
                  <p className="text-white/80">Sign in and start using the Graduation Project Platform</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Registration Form */}
      <div className="w-1/2 flex items-center justify-center p-12 bg-[var(--color-surface-white)] overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <img src={gppLogo} alt="GPP FCIT KAU" className="w-64 mx-auto mb-6" />
            <h1 className="text-[var(--color-text-900)] mb-2">Create Account</h1>
            <p className="text-[var(--color-text-600)]">Register as a student or supervisor</p>
          </div>

          {/* Account Type Tabs */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setAccountType('student')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-[1.5px] transition-all ${
                accountType === 'student'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-text-600)] hover:border-[var(--color-text-400)]'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
              <span className="font-medium">Student</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('supervisor')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-[1.5px] transition-all ${
                accountType === 'supervisor'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-text-600)] hover:border-[var(--color-text-400)]'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Supervisor</span>
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {accountType === 'student' ? (
              <>
                {/* Student Form */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="s-fname">First Name</Label>
                    <Input id="s-fname" placeholder="First name" value={studentFirstName} onChange={(e) => setStudentFirstName(e.target.value)} className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="s-lname">Last Name</Label>
                    <Input id="s-lname" placeholder="Last name" value={studentLastName} onChange={(e) => setStudentLastName(e.target.value)} className="mt-1" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="s-id">Student ID</Label>
                    <Input id="s-id" placeholder="e.g. 2136XXX" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="s-email">University Email</Label>
                    <Input id="s-email" type="email" placeholder="Ahmed@stu.kau.edu.sa" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} className="mt-1" required />
                  </div>
                </div>

                <div>
                  <Label htmlFor="s-password">Password</Label>
                  <Input id="s-password" type="password" placeholder="Create a password" value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)} className="mt-1" required />
                </div>

                <div>
                  <Label htmlFor="s-confirm-password">Confirm Password</Label>
                  <Input id="s-confirm-password" type="password" placeholder="Confirm your password" value={studentConfirmPassword} onChange={(e) => setStudentConfirmPassword(e.target.value)} className="mt-1" required />
                </div>

                <div>
                  <Label htmlFor="s-dept">Department</Label>
                  <Select value={studentDepartment} onValueChange={setStudentDepartment} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="proj-name">Project Name</Label>
                  <Input id="proj-name" placeholder="Enter your project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="mt-1" required />
                </div>

                <div>
                  <Label htmlFor="proj-about">About the Project</Label>
                  <Textarea id="proj-about" placeholder="Briefly describe your graduation project..." value={aboutProject} onChange={(e) => setAboutProject(e.target.value)} className="mt-1" rows={3} required />
                </div>

                <div>
                  <Label htmlFor="proj-area">Area of Project</Label>
                  <Select value={projectArea} onValueChange={setProjectArea} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select project area" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectAreas.map((area) => (
                        <SelectItem key={area.value} value={area.value}>{area.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="supervisor">Select Supervisor</Label>
                  <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockSupervisors.map((sup) => (
                        <SelectItem key={sup.value} value={sup.value}>{sup.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {/* Supervisor Form */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sv-fname">First Name</Label>
                    <Input id="sv-fname" placeholder="First name" value={supervisorFirstName} onChange={(e) => setSupervisorFirstName(e.target.value)} className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="sv-lname">Last Name</Label>
                    <Input id="sv-lname" placeholder="Last name" value={supervisorLastName} onChange={(e) => setSupervisorLastName(e.target.value)} className="mt-1" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sv-id">Supervisor ID</Label>
                    <Input id="sv-id" placeholder="Employee ID" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="sv-email">University Email</Label>
                    <Input id="sv-email" type="email" placeholder="Abdullah@kau.edu.sa" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} className="mt-1" required />
                  </div>
                </div>

                <div>
                  <Label htmlFor="sv-password">Password</Label>
                  <Input id="sv-password" type="password" placeholder="Create a password" value={supervisorPassword} onChange={(e) => setSupervisorPassword(e.target.value)} className="mt-1" required />
                </div>

                <div>
                  <Label htmlFor="sv-confirm-password">Confirm Password</Label>
                  <Input id="sv-confirm-password" type="password" placeholder="Confirm your password" value={supervisorConfirmPassword} onChange={(e) => setSupervisorConfirmPassword(e.target.value)} className="mt-1" required />
                </div>

                <div>
                  <Label htmlFor="sv-dept">Department</Label>
                  <Select value={supervisorDepartment} onValueChange={setSupervisorDepartment} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button type="submit" className="w-full mt-6">
              Submit for Approval
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-[var(--color-primary-600)] hover:underline">
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>

      {/* Right Panel - Platform Info */}
      <div className="w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] p-12 flex items-center justify-center text-white">
        <div className="max-w-md">
          <h2 className="text-white mb-6">Graduation Project Platform</h2>
          <p className="mb-8 text-white/90">
            A comprehensive platform for managing graduation projects at FCIT, King Abdulaziz University.
          </p>

          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Track Milestones</h3>
                <p className="text-white/80">Monitor deadlines for chapters, reports, and presentations</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Submit & Review</h3>
                <p className="text-white/80">Upload submissions and receive detailed feedback from supervisors</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Transparent Grading</h3>
                <p className="text-white/80">View rubric-based evaluations and track your progress</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
