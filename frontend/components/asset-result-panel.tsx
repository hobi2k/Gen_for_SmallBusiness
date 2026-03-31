type AssetValue = string | string[] | Record<string, string | string[]>;

type AssetResultPanelProps = {
  title: string;
  description: string;
  status: string | null;
  result: {
    message?: string;
    project_root?: string;
    asset_paths?: Record<string, AssetValue>;
  } | null;
};

function renderValue(value: AssetValue) {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2">
        {value.map((item) => (
          <li key={item} className="break-all rounded-2xl bg-black/5 px-3 py-2 text-xs text-black/68">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object') {
    return (
      <pre className="overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-black/5 p-3 text-xs leading-6 text-black/68">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <p className="break-all rounded-2xl bg-black/5 px-3 py-2 text-xs text-black/68">{value}</p>;
}

export function AssetResultPanel({title, description, status, result}: AssetResultPanelProps) {
  return (
    <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,32,0.08)]">
      <p className="text-xs uppercase tracking-[0.24em] text-black/36">결과</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#101828]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-black/58">{description}</p>

      <div className="mt-6 rounded-[24px] bg-[#f7f5ef] p-4">
        <p className="text-sm font-medium text-black/72">{status ?? '아직 생성 전입니다.'}</p>
      </div>

      {result ? (
        <div className="mt-6 space-y-4">
          {result.message ? (
            <div className="rounded-[24px] border border-black/10 p-4">
              <p className="text-sm font-medium text-black/75">응답 문구</p>
              <p className="mt-2 text-sm leading-6 text-black/62">{result.message}</p>
            </div>
          ) : null}

          {result.project_root ? (
            <div className="rounded-[24px] border border-black/10 p-4">
              <p className="text-sm font-medium text-black/75">저장 위치</p>
              <p className="mt-2 break-all text-sm leading-6 text-black/62">{result.project_root}</p>
            </div>
          ) : null}

          {result.asset_paths ? (
            <div className="space-y-3">
              {Object.entries(result.asset_paths).map(([key, value]) => (
                <div key={key} className="rounded-[24px] border border-black/10 p-4">
                  <p className="text-sm font-medium capitalize text-black/75">{key}</p>
                  <div className="mt-3">{renderValue(value)}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
