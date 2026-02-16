
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';

export default function VerifyEmailPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-10 w-10 text-primary"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                        />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold tracking-tight">تحقق من بريدك الإلكتروني</h1>

                <p className="text-muted-foreground">
                    لقد أرسلنا رابط تفعيل إلى بريدك الإلكتروني. يرجى الضغط على الرابط لتسجيل الدخول والبدء.
                </p>

                <div className="pt-4">
                    <Link href="/signin" className={`${buttonVariants('outline')} w-full`}>
                        العودة لتسجيل الدخول
                    </Link>
                </div>
            </div>
        </div>
    );
}
