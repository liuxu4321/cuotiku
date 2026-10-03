import type { AgentAnalogyResult, AgentExplainResult, AgentRequest } from '@shared/types'
import { agentAnalogy, agentExplain } from './api-client'
import { setKeepaliveState } from './keepalive'

export async function runAgentExplain(request: AgentRequest): Promise<AgentExplainResult> {
  setKeepaliveState('busy')
  try {
    return await agentExplain(request)
  } finally {
    setKeepaliveState('idle')
  }
}

export async function runAgentAnalogy(request: AgentRequest): Promise<AgentAnalogyResult> {
  setKeepaliveState('busy')
  try {
    return await agentAnalogy(request)
  } finally {
    setKeepaliveState('idle')
  }
}
