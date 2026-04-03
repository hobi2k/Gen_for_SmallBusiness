"use client";

import { GeneratedResultsPanel } from "@/app/components/home/GeneratedResultsPanel";
import { HeroSection } from "@/app/components/home/HeroSection";
import { SeedPanel } from "@/app/components/home/SeedPanel";
import { StyleSelectionPanel } from "@/app/components/home/StyleSelectionPanel";
import { UploadPanel } from "@/app/components/home/UploadPanel";
import { useHomePageFlow } from "@/app/hooks/useHomePageFlow";

const STYLE_SECTION_ID = "style-section";
const RESULT_SECTION_ID = "result-section";

export default function HomePage() {
  const flow = useHomePageFlow({ resultSectionId: RESULT_SECTION_ID });

  return (
    <main className="page-shell">
      <HeroSection />

      <div className="workspace">
        <SeedPanel
          activeSeedId={flow.activeSeedId}
          devSeeds={flow.devSeeds}
          loadingSeeds={flow.loadingSeeds}
          onSeedLoad={flow.handleSeedLoad}
        />
        <UploadPanel
          activeSeedId={flow.activeSeedId}
          file={flow.file}
          supplementalFiles={flow.supplementalFiles}
          inputOverrides={flow.inputOverrides}
          onApplyInputOverrides={flow.handleApplyInputOverrides}
          onInputOverridesChange={flow.handleInputOverridesChange}
          onUpload={flow.handleUpload}
          previewUrl={flow.previewUrl}
          recommending={flow.recommending}
        />

        {flow.error ? <div className="error-box">{flow.error}</div> : null}

        {flow.analysis ? (
          <StyleSelectionPanel
            allStyles={flow.allStyles}
            analysis={flow.analysis}
            generating={flow.generating}
            onGenerate={() => flow.handleGenerate(0)}
            onSelectStyle={flow.handleSelectStyle}
            recommendationFallbackUsed={flow.recommendationFallbackUsed}
            recommendations={flow.recommendations}
            sectionId={STYLE_SECTION_ID}
            selectedStyle={flow.selectedStyle}
            selectedStyleId={flow.selectedStyleId}
          />
        ) : null}

        {flow.generating || flow.generatedPackage ? (
          <GeneratedResultsPanel
            copiedKey={flow.copiedKey}
            generatedPackage={flow.generatedPackage}
            generating={flow.generating}
            onChangeStyle={() => {
              document
                .getElementById(STYLE_SECTION_ID)
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            onCopy={flow.handleCopyText}
            onRegenerate={() => flow.handleGenerate(flow.regenerateCount + 1)}
            sectionId={RESULT_SECTION_ID}
          />
        ) : null}
      </div>
    </main>
  );
}
