const marketingCards = [
  {
    title: "Brand",
    subtitle: "Identity & positioning",
    icon: "✦",
    className: "card-brand",
  },
  {
    title: "Social",
    subtitle: "Content & engagement",
    icon: "◉",
    className: "card-social",
  },
  {
    title: "TikTok",
    subtitle: "Short-form strategy",
    icon: "♪",
    className: "card-tiktok",
  },
  {
    title: "Fashion",
    subtitle: "Trends & campaigns",
    icon: "◌",
    className: "card-fashion",
  },
  {
    title: "Creators",
    subtitle: "Influencer insights",
    icon: "◎",
    className: "card-creators",
  },
  {
    title: "Coffee",
    subtitle: "Audience & growth",
    icon: "☕",
    className: "card-coffee",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#2a073c]">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 animate-[float_12s_ease-in-out_infinite] rounded-full bg-[#e8d4f1] opacity-70 blur-3xl" />

        <div className="absolute -right-40 top-40 h-[500px] w-[500px] animate-[floatReverse_15s_ease-in-out_infinite] rounded-full bg-[#cba5ea] opacity-30 blur-3xl" />

        <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-[pulseSoft_8s_ease-in-out_infinite] rounded-full bg-[#b57fdc] opacity-20 blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <a href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a073c] text-lg text-white shadow-lg shadow-[#2a073c]/20 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
            ✦
          </div>

          <div>
            <p className="text-sm font-semibold tracking-tight text-[#2a073c]">
              Marketing Intelligence
            </p>

            <p className="text-[10px] uppercase tracking-[0.2em] text-[#b57fdc]">
              AI Assistant
            </p>
          </div>
        </a>

        <div className="hidden items-center gap-8 text-sm text-[#695574] md:flex">
          <a
            href="#capabilities"
            className="transition-colors hover:text-[#b57fdc]"
          >
            Capabilities
          </a>

          <a
            href="#how-it-works"
            className="transition-colors hover:text-[#b57fdc]"
          >
            How it works
          </a>

          <a
            href="/sign-in"
            className="transition-colors hover:text-[#b57fdc]"
          >
            Sign in
          </a>

          <a
            href="/sign-up"
            className="rounded-full bg-[#2a073c] px-5 py-2.5 font-medium text-white shadow-lg shadow-[#2a073c]/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#3b1053] hover:shadow-xl"
          >
            Get started
          </a>
        </div>

        <a
          href="/sign-up"
          className="rounded-full bg-[#2a073c] px-4 py-2 text-sm font-medium text-white md:hidden"
        >
          Start
        </a>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-10 lg:pb-28 lg:pt-24">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left */}
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex animate-[fadeUp_0.7s_ease-out_both] items-center gap-2 rounded-full border border-[#e8d4f1] bg-[#e8d4f1]/40 px-4 py-2 text-xs font-medium text-[#2a073c] shadow-sm backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#b57fdc]" />
              Your AI-powered marketing assistant
            </div>

            <h1 className="animate-[fadeUp_0.8s_0.1s_ease-out_both] text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Turn your marketing
              <span className="block text-[#b57fdc]">
                into intelligence.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl animate-[fadeUp_0.8s_0.2s_ease-out_both] text-base leading-7 text-[#695574] sm:text-lg">
              An AI marketing assistant that understands your brand, analyzes
              your business data, researches your market, and helps you make
              better marketing decisions.
            </p>

            <div className="mt-9 flex flex-col gap-3 animate-[fadeUp_0.8s_0.3s_ease-out_both] sm:flex-row">
              <a
                href="/sign-up"
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#2a073c] px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-[#2a073c]/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#3b1053] hover:shadow-2xl"
              >
                Create your brand

                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </a>

              <a
                href="#capabilities"
                className="inline-flex items-center justify-center rounded-full border border-[#e8d4f1] bg-white px-7 py-3.5 text-sm font-semibold text-[#2a073c] transition-all duration-300 hover:-translate-y-1 hover:border-[#b57fdc] hover:bg-[#e8d4f1]/30"
              >
                Explore capabilities
              </a>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#8b7895]">
              <span>Brand intelligence</span>
              <span className="h-1 w-1 rounded-full bg-[#cba5ea]" />
              <span>Business analytics</span>
              <span className="h-1 w-1 rounded-full bg-[#cba5ea]" />
              <span>Market research</span>
            </div>
          </div>

          {/* Animated marketing universe */}
          <div className="relative mx-auto h-[500px] w-full max-w-[560px]">
            <div className="absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rotate-[-3deg] rounded-[42px] border border-white/80 bg-white/60 shadow-[0_30px_100px_rgba(42,7,60,0.14)] backdrop-blur-xl" />

            <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 animate-[pulseSoft_5s_ease-in-out_infinite] rounded-full bg-gradient-to-br from-[#e8d4f1] via-[#cba5ea] to-[#b57fdc] opacity-90 blur-[1px]" />

            <div className="absolute left-1/2 top-1/2 z-20 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-[float_6s_ease-in-out_infinite] flex-col items-center justify-center rounded-[30px] border border-white/80 bg-white/95 shadow-2xl shadow-[#2a073c]/20 backdrop-blur-xl">
              <span className="text-3xl text-[#b57fdc]">✦</span>

              <span className="mt-1 text-xs font-semibold text-[#2a073c]">
                AI Assistant
              </span>

              <span className="mt-1 text-[9px] uppercase tracking-widest text-[#9b88a5]">
                Thinking
              </span>
            </div>

            <div className="absolute left-1/2 top-1/2 h-[410px] w-[410px] -translate-x-1/2 -translate-y-1/2 animate-[spinSlow_30s_linear_infinite] rounded-full border border-dashed border-[#cba5ea]" />

            {marketingCards.map((card, index) => (
              <div
                key={card.title}
                className={`absolute z-30 ${card.className} animate-[floatCard_6s_ease-in-out_infinite]`}
                style={{
                  animationDelay: `${index * -0.8}s`,
                }}
              >
                <div className="group rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-xl shadow-[#2a073c]/10 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8d4f1] text-lg text-[#2a073c]">
                      {card.icon}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#2a073c]">
                        {card.title}
                      </p>

                      <p className="mt-0.5 whitespace-nowrap text-[10px] text-[#8b7895]">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Analytics */}
            <div className="absolute bottom-8 left-1/2 z-40 -translate-x-1/2 animate-[float_7s_1s_ease-in-out_infinite]">
              <div className="rounded-2xl border border-white/80 bg-white/95 px-5 py-3 shadow-xl shadow-[#2a073c]/10 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[#9b88a5]">
                      Marketing insight
                    </p>

                    <p className="mt-1 text-sm font-semibold text-[#2a073c]">
                      Audience engagement
                    </p>
                  </div>

                  <div className="flex items-end gap-1">
                    <span className="h-3 w-1.5 rounded-full bg-[#e8d4f1]" />
                    <span className="h-5 w-1.5 rounded-full bg-[#cba5ea]" />
                    <span className="h-7 w-1.5 rounded-full bg-[#b57fdc]" />
                    <span className="h-10 w-1.5 rounded-full bg-[#2a073c]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section
        id="capabilities"
        className="border-y border-[#e8d4f1] bg-[#e8d4f1]/20 px-6 py-24 lg:px-10"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b57fdc]">
              One assistant. Your whole marketing context.
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#2a073c] sm:text-4xl">
              Built around how modern brands actually grow.
            </h2>

            <p className="mt-4 leading-7 text-[#695574]">
              Connect your brand knowledge, business data, social channels,
              documents and market information. The assistant brings them
              together when answering a marketing question.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                "✦",
                "Brand intelligence",
                "Understand your positioning, audience, voice, values and marketing constraints.",
              ],
              [
                "◉",
                "Social media",
                "Analyze content, engagement and channel performance to uncover opportunities.",
              ],
              [
                "♪",
                "TikTok & short-form",
                "Research trends, formats and creative opportunities for short-form content.",
              ],
              [
                "◌",
                "Fashion & trends",
                "Connect market signals, products, trends and customer behavior.",
              ],
              [
                "◎",
                "Creator intelligence",
                "Understand influencer and creator opportunities around your brand.",
              ],
              [
                "⌁",
                "Business analytics",
                "Ask questions about your marketing data and receive evidence-backed insights.",
              ],
            ].map(([icon, title, description]) => (
              <div
                key={title}
                className="group rounded-3xl border border-[#e8d4f1] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#b57fdc] hover:shadow-xl hover:shadow-[#b57fdc]/10"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8d4f1] text-xl text-[#2a073c] transition-transform duration-300 group-hover:scale-110">
                  {icon}
                </div>

                <h3 className="mt-6 font-semibold text-[#2a073c]">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-[#74647e]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b57fdc]">
                Your marketing context
              </p>

              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#2a073c] sm:text-4xl">
                Not just a chatbot.
                <span className="block text-[#b57fdc]">
                  A marketing intelligence system.
                </span>
              </h2>

              <p className="mt-5 max-w-xl leading-7 text-[#695574]">
                The assistant combines your brand context, approved business
                data, documents, web research and analytical tools before
                producing an answer.
              </p>

              <a
                href="/sign-up"
                className="mt-8 inline-flex rounded-full bg-[#2a073c] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-[#3b1053]"
              >
                Build your marketing workspace →
              </a>
            </div>

            <div className="relative rounded-[32px] border border-[#e8d4f1] bg-white p-5 shadow-2xl shadow-[#2a073c]/5">
              {[
                ["01", "Understand", "Your brand & objective"],
                ["02", "Investigate", "Data, knowledge & market"],
                ["03", "Reason", "Evidence-backed analysis"],
                ["04", "Recommend", "Clear marketing actions"],
              ].map(([number, title, description]) => (
                <div
                  key={number}
                  className="group flex items-center gap-5 border-b border-[#eee5f2] p-5 last:border-0"
                >
                  <span className="text-xs font-semibold text-[#b57fdc]">
                    {number}
                  </span>

                  <div className="flex-1">
                    <p className="font-semibold text-[#2a073c]">{title}</p>

                    <p className="mt-1 text-sm text-[#8b7895]">
                      {description}
                    </p>
                  </div>

                  <span className="text-[#b57fdc] transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-10 lg:px-10">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[40px] bg-[#2a073c] px-8 py-16 text-center text-white shadow-2xl shadow-[#2a073c]/25 sm:px-12">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cba5ea]">
              Your brand deserves more than generic answers.
            </p>

            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              Build your marketing intelligence workspace.
            </h2>

            <p className="mx-auto mt-5 max-w-xl leading-7 text-[#e8d4f1]">
              Give your AI assistant the context it needs to understand your
              brand and your business.
            </p>

            <a
              href="/sign-up"
              className="mt-8 inline-flex rounded-full bg-[#b57fdc] px-7 py-3.5 text-sm font-semibold text-[#2a073c] transition-all duration-300 hover:-translate-y-1 hover:bg-[#cba5ea]"
            >
              Get started →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-xs text-[#8b7895] sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <p>© 2026 Marketing Intelligence.</p>

        <p>AI-powered marketing intelligence for modern brands.</p>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        @keyframes floatReverse {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(15px);
          }
        }

        @keyframes floatCard {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-9px) rotate(1deg);
          }
        }

        @keyframes pulseSoft {
          0%, 100% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.9;
          }
        }

        @keyframes spinSlow {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        .card-brand {
          left: 2%;
          top: 13%;
        }

        .card-social {
          right: 0;
          top: 27%;
        }

        .card-tiktok {
          left: 1%;
          bottom: 27%;
        }

        .card-fashion {
          right: 2%;
          bottom: 17%;
        }

        .card-creators {
          left: 23%;
          top: 2%;
        }

        .card-coffee {
          right: 24%;
          bottom: 1%;
        }

        @media (max-width: 640px) {
          .card-brand {
            left: 0;
            top: 12%;
          }

          .card-social {
            right: 0;
            top: 25%;
          }

          .card-tiktok {
            left: 0;
            bottom: 25%;
          }

          .card-fashion {
            right: 0;
            bottom: 15%;
          }

          .card-creators {
            left: 20%;
            top: 3%;
          }

          .card-coffee {
            right: 18%;
            bottom: 1%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </main>
  );
}

