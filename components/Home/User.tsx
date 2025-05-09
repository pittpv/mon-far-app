import { useMiniAppContext } from "@/hooks/use-miniapp-context";

export function User() {
  const { context } = useMiniAppContext();
  const user = context?.user;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-md w-full transition-colors duration-300">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">User Info</h2>
      {user ? (
        <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-4 space-y-4 sm:space-y-0">
          {user.pfpUrl && (
            <img
              src={user.pfpUrl}
              alt="User Profile"
              className="w-20 h-20 rounded-full border border-gray-300 dark:border-gray-600 object-cover"
            />
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm text-gray-700 dark:text-gray-300 w-full">
            <UserRow label="Name" value={user.displayName} />
            <UserRow label="Username" value={user.username} />
            <UserRow label="FID" value={user.fid?.toString()} />
          </div>
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm">User context not available</p>
      )}
    </div>
  );
}

function UserRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col break-words">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md font-mono text-gray-800 dark:text-gray-200 break-all">
        {value ?? "—"}
      </span>
    </div>
  );
}
