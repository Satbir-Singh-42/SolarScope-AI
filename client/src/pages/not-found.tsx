import { Button } from "@/components/ui/button";
import { Sun, Home, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import Navbar from "@/components/navbar";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <div
        className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-orange-50"
        style={{ paddingTop: "3.75rem" }}>
        <div className="text-center px-4 max-w-lg mx-auto">
          {/* Animated sun icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-200">
              <Sun className="h-12 w-12 text-white" strokeWidth={1.5} />
            </div>
          </motion.div>

          {/* 404 text */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-7xl font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent mb-3">
            404
          </motion.h1>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-2xl font-semibold text-gray-800 mb-3">
            Page Not Found
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-gray-500 mb-8 leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Let's
            get you back on track.
          </motion.p>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white px-6 gap-2">
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
            <Button
              variant="outline"
              className="border-blue-200 text-blue-600 hover:bg-blue-50 px-6 gap-2"
              onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </motion.div>
        </div>
      </div>
    </>
  );
}
