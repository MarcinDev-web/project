use crate::node::NodeBehavior;
use crate::signal::{Signal, SignalData};
use crate::vm::LogicExecutionContext;

pub struct VariableNode {
    pub name: String,
}

impl NodeBehavior for VariableNode {
    fn on_signal(&mut self, port_id: u8, signal: &Signal, ctx: &mut LogicExecutionContext) -> Option<Vec<(u8, Signal)>> {
        match port_id {
            0 => { // Set
                ctx.variables.insert(self.name.clone(), signal.data.clone());
                Some(vec![(1, Signal { // On Set
                    source_node: 0,
                    source_port: 1,
                    data: SignalData::None,
                })])
            },
            1 => { // Get
                if let Some(val) = ctx.variables.get(&self.name) {
                    Some(vec![(0, Signal { // Value
                        source_node: 0,
                        source_port: 0,
                        data: val.clone(),
                    })])
                } else {
                    None
                }
            },
            _ => None
        }
    }
}

