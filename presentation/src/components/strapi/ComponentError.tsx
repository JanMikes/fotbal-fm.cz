interface ComponentErrorProps {
  componentType: string;
}

export function ComponentError({ componentType }: ComponentErrorProps) {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="border-2 border-dashed border-red-300 bg-red-50 p-4 rounded">
      <p className="text-sm text-red-600 font-mono">
        Unknown component: <strong>{componentType}</strong>
      </p>
    </div>
  );
}
