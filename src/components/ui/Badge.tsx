interface BadgeProps {
  status: string;
  className?: string;
}

const colorMap: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  listed: "bg-blue-100 text-blue-800",
  sold: "bg-gray-100 text-gray-700",
  archived: "bg-gray-100 text-gray-500",
  draft: "bg-yellow-100 text-yellow-800",
  active: "bg-blue-100 text-blue-800",
  ended: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
  meta: "bg-blue-100 text-blue-700",
  ebay: "bg-orange-100 text-orange-700",
  mercari: "bg-red-100 text-red-700",
  Excellent: "bg-green-100 text-green-800",
  Good: "bg-blue-100 text-blue-800",
  Fair: "bg-yellow-100 text-yellow-800",
  Poor: "bg-red-100 text-red-700",
};

export default function Badge({ status, className = "" }: BadgeProps) {
  const color = colorMap[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${color} ${className}`}
    >
      {status}
    </span>
  );
}
