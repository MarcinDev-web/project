use crate::node::NodeBehavior;
use crate::signal::{Signal, SignalData};
use crate::vm::LogicExecutionContext;

pub struct AndNode {
    pub state_a: bool,
    pub state_b: bool,
}

impl NodeBehavior for AndNode {
    fn on_signal(&mut self, port_id: u8, signal: &Signal, _ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>> {
        // Input A = 0, Input B = 1
        match port_id {
            0 => self.state_a = true,
            1 => self.state_b = true,
            _ => return None,
        }

        if self.state_a && self.state_b {
            // Reset state (configurable? assuming auto-reset for now)
            self.state_a = false;
            self.state_b = false;
            
            return Some(vec![(0, Signal {
                source_node: 0, // Placeholder, VM should overwrite
                source_port: 0,
                data: SignalData::None,
            })]);
        }
        None
    }
}

pub struct OrNode;

impl NodeBehavior for OrNode {
    fn on_signal(&mut self, _port_id: u8, _signal: &Signal, _ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>> {
        // Any input triggers output
        Some(vec![(0, Signal {
            source_node: 0,
            source_port: 0,
            data: SignalData::None,
        })])
    }
}

