import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "@/components/NavLink";
import { BrandTitle } from "@/components/BrandTitle";
import { MathInlineText, MathText } from "@/components/MathText";

// Check by eye (Phase 1 checklist): English and Bangla text, conjunct letters, and display-only math.
// Holds only sample sentences, so it opens without an account.
const CONJUNCTS = "ক্ষ জ্ঞ ঞ্চ ঙ্ক ত্র ন্ত্র ক্ত ষ্ণ হ্ম শ্চ দ্ধ ম্ভ স্ত্র র্ক্ষ";

export default function FontTestPage() {
  return (
    <main className="shell shell-wide">
      <div className="between topbar">
        <BrandTitle />
        <Link href="/login" className="btn btn-small">
          Sign in
        </Link>
      </div>

      <div className="stack-sm">
        <h1 className="title">
          Font <span className="accent">Test</span>
        </h1>
        <h2 className="title bn-title">
          ফন্ট <span className="bn-accent">পরীক্ষা</span>
        </h2>
        <p className="muted">The same sentence in both languages, then conjunct letters and math. Courier Prime has no Bengali letters, so the Bangla title uses bold Noto Sans Bengali with the accent word on yellow.</p>
      </div>

      <section className="card-orange stack-sm">
        <p className="label label-orange">English, Hanken Grotesk</p>
        <p className="sample">Bangladesh became independent in 1971, and its national flower is the water lily.</p>
      </section>

      <section className="card-orange stack-sm">
        <p className="label label-orange">Bangla, Noto Sans Bengali</p>
        <p className="sample bn">১৯৭১ সালে বাংলাদেশ স্বাধীন হয়, এবং এর জাতীয় ফুল শাপলা।</p>
      </section>

      <section className="card-shadow stack-sm">
        <p className="label">Conjunct letters (each should join into one shape)</p>
        <p className="sample-big bn">{CONJUNCTS}</p>
        <p className="sample bn">বিজ্ঞান, পরীক্ষা, সংস্কৃতি, উজ্জ্বল, অন্তর্দ্বন্দ্ব, রাষ্ট্রপতি, শিক্ষার্থী, ব্যাকরণ, কৃষ্ণচূড়া, স্বাক্ষর</p>
      </section>

      <section className="card-shadow stack-sm">
        <p className="label">Mixed text in one line (the font stack handles both)</p>
        <p className="sample">The Bangla word for science is বিজ্ঞান, and for examination it is পরীক্ষা.</p>
      </section>

      <section className="card-shadow stack-sm">
        <p className="label">Math, display only (a fraction and a square root)</p>
        <MathText className="sample" text={"The mean of $a$ and $b$ is $\\frac{a+b}{2}$, and the side of a square of area $A$ is $\\sqrt{A}$."} />
        <MathText text={"$$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$"} />
        <p className="sample bn">
          <MathInlineText text={"দুটি সংখ্যার গড় $\\frac{a+b}{2}$ এবং $\\sqrt{16}=4$।"} />
        </p>
      </section>

      <section className="dashed stack-sm">
        <p className="label label-orange">Icons (lucide-react)</p>
        <div className="wrap">
          <button type="button" className="btn btn-icon" aria-label="Previous">
            <ChevronLeft className="ico" aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-icon" aria-label="Next">
            <ChevronRight className="ico" aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}
