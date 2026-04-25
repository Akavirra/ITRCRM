'use client';

interface CertificatesTableSkeletonProps {
  columns?: number;
  rows?: number;
}

export default function CertificatesTableSkeleton({
  columns = 6,
  rows = 5,
}: CertificatesTableSkeletonProps) {
  return (
    <table className="table">
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={`h-${i}`}>
              <div
                className="skeleton"
                style={{
                  height: '12px',
                  width: `${50 + (i % 3) * 15}%`,
                  borderRadius: '4px',
                }}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={`r-${rowIndex}`}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={`c-${rowIndex}-${colIndex}`}>
                <div
                  className="skeleton"
                  style={{
                    height: '14px',
                    width: `${45 + ((rowIndex + colIndex) % 5) * 12}%`,
                    borderRadius: '4px',
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
