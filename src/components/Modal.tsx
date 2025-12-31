'use client';

import { ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export default function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-gray-900 border-t sm:border border-gray-800 rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl sm:rounded-t-xl">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-700 rounded-full sm:hidden" />
          <h3 className="font-semibold mt-2 sm:mt-0">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
