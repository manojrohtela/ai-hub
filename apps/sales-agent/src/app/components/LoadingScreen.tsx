import { motion } from "motion/react";
import { Brain, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { BackgroundGradient } from "./ui/BackgroundGradient";

const steps = [
  "Understanding structure",
  "Detecting patterns",
  "Generating insights",
];

export function LoadingScreen() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell min-h-screen flex items-center justify-center relative overflow-hidden">
      <BackgroundGradient variant="centered" />

      <div className="text-center relative z-10">
        {/* Animated AI Icon */}
        <motion.div
          className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-indigo-500/50"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Brain className="w-12 h-12 text-white" />
        </motion.div>

        {/* Main Text */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 text-3xl font-bold text-foreground"
        >
          Analyzing your data...
        </motion.h2>

        {/* Steps */}
        <div className="space-y-3 max-w-md mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.2 }}
              className="flex items-center gap-3 justify-center"
            >
              {currentStep > index ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </motion.div>
              ) : currentStep === index ? (
                <motion.div
                  className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-border" />
              )}
              <span
                className={`text-lg ${
                  currentStep >= index ? "text-foreground" : "app-subtle-text"
                }`}
              >
                {step}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="mt-8 mx-auto h-1.5 w-64 overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
}
