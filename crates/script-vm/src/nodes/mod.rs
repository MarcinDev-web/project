pub mod logic;
pub mod flow;
pub mod data;

use crate::node::{NodeBehavior, NodeType};
use logic::{AndNode, OrNode};
use flow::{DelayNode, TimerNode};
use data::VariableNode;

pub fn create_behavior(type_id: NodeType, config: &[u8]) -> Box<dyn NodeBehavior> {
    match type_id {
        NodeType::And => Box::new(AndNode { state_a: false, state_b: false }),
        NodeType::Or => Box::new(OrNode),
        NodeType::Delay => {
            let delay_time = if config.len() >= 4 {
                f32::from_le_bytes([config[0], config[1], config[2], config[3]])
            } else {
                1.0
            };
            Box::new(DelayNode { delay_time, active_delays: Vec::new() })
        },
        NodeType::Timer => {
            let duration = if config.len() >= 4 {
                f32::from_le_bytes([config[0], config[1], config[2], config[3]])
            } else {
                1.0
            };
            Box::new(TimerNode { duration, current_time: 0.0, running: false })
        },
        NodeType::Variable => {
            let name = String::from_utf8_lossy(config).to_string();
            Box::new(VariableNode { name })
        },
        _ => Box::new(OrNode), // Fallback/Placeholder
    }
}
