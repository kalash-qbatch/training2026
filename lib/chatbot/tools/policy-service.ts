import rawPolicies from "../data/store-policies.json";
import type { StorePoliciesData, StorePolicyTopic } from "../types";
import type { GetStorePoliciesInput } from "./tool-schemas";

const policies: StorePoliciesData = rawPolicies as StorePoliciesData;

export function getStorePolicies(params: GetStorePoliciesInput): {
  topic: string;
  policy: StorePolicyTopic | StorePoliciesData;
} {
  const topic = params.topic.toLowerCase();

  switch (topic) {
    case "shipping":
      return { topic: "shipping", policy: policies.shipping };
    case "returns":
    case "refund":
    case "refunds":
      return { topic: "returns", policy: policies.returns };
    case "payment":
    case "payments":
      return { topic: "payment", policy: policies.payment };
    case "warranty":
    case "guarantee":
      return { topic: "warranty", policy: policies.warranty };
    case "support":
    case "contact":
      return { topic: "support", policy: policies.support };
    case "all":
    default:
      return { topic: "all", policy: policies };
  }
}
