export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8 animate-pulse">
      <div className="flex justify-between items-center mb-8">
        <div className="h-8 w-48 rounded bg-gray-200"></div>
        <div className="h-10 w-32 rounded-md bg-gray-200"></div>
      </div>
      
      <div className="space-y-4 rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-6 w-32 rounded bg-gray-200 mb-6"></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-32 rounded-md bg-gray-100"></div>
          <div className="h-32 rounded-md bg-gray-100"></div>
          <div className="h-32 rounded-md bg-gray-100"></div>
        </div>
      </div>
    </div>
  )
}