"use client";

import { FarcasterActions } from "@/components/Home/FarcasterActions";
import { User } from "@/components/Home/User";
import { WalletActions } from "@/components/Home/WalletActions";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#fdfbfb] to-[#ebedee] flex flex-col items-center justify-center px-4 py-10">
      <motion.h1
        className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-center text-gray-800 mb-8 leading-tight"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Make the World Happier
        <br/>
        <span className="w-full text-gray-800 font-medium text-sm">Cast Your Vote Now</span>
      </motion.h1>

      <div className="w-full max-w-5xl space-y-6">
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <WalletActions />
        </motion.div>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <User />
        </motion.div>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <FarcasterActions />
        </motion.div>
      </div>
    </div>
  );
}
