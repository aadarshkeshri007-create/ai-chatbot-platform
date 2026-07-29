export default function LoginPage() {
  return (
    <div className="min-h-screen flex justify-center items-center flex-col gap-6">
      <div className="w-full max-w-md p-8 rounded-lg border-2 border-gray-300 shadow-md flex flex-col gap-6 ">
        <header className="flex flex-col
         gap-2">
          <h1 className="text-2xl font-bold font-sans">
            AI Customer Support Platform
          </h1>
          <p className="text-base text-left">
            Welcome back! Please log in to continue.
          </p>
        </header>
        <form className="flex flex-col gap-4">
          <label htmlFor="email">Email</label>
          <input
            className="border border-gray-300 rounded-lg p-2"
            placeholder="Enter your email"
            type="email" id="email"
          />
          <label htmlFor="password">Password</label>
          <input
            className="border border-gray-300 rounded-lg p-2"
            type="password"
            placeholder="Enter your password"
            id="password"
          />
          <button className="w-full mt-4 rounded-lg p-2 bg-blue-600 hover:bg-blue-700 transition-colors duration-300 text-white font-semibold">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
