import { ReactNode } from 'react';

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`safe-area-inline mx-auto w-full max-w-6xl ${className}`}>
      {children}
    </div>
  );
}
